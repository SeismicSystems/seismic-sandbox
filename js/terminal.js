import { networks, defaultNetwork } from './config.js';
import { commands, findCommand, getMethodNames } from './commands.js';
import { rpcCall, rawRpcCall } from './rpc.js';
import { highlightJSON } from './highlight.js';

export class Terminal {
  constructor() {
    this.network = defaultNetwork;
    this.history = JSON.parse(sessionStorage.getItem('seismic_history') || '[]');
    this.historyIdx = this.history.length;
    this.paramState = null; // for multi-step param input

    this.output = document.getElementById('output');
    this.input = document.getElementById('cmd-input');
    this.prompt = document.getElementById('prompt-label');
    this.runBtn = document.getElementById('run-btn');

    this.bindEvents();
    this.renderChips();
    this.updateNetworkUI();
    this.printWelcome();
    this.input.focus();
  }

  // --- events ---

  bindEvents() {
    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.runBtn.addEventListener('click', () => this.submit());

    document.getElementById('btn-testnet').addEventListener('click', () => this.switchNetwork('testnet'));
    document.getElementById('btn-devnet').addEventListener('click', () => this.switchNetwork('devnet'));

    document.getElementById('chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-method]');
      if (chip) this.runChip(chip.dataset.method);
    });

    // keep focus on input when clicking output area
    this.output.addEventListener('click', () => this.input.focus());
  }

  onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.autocomplete();
    }
  }

  // --- history ---

  pushHistory(val) {
    if (val && this.history[this.history.length - 1] !== val) {
      this.history.push(val);
      if (this.history.length > 100) this.history.shift();
      sessionStorage.setItem('seismic_history', JSON.stringify(this.history));
    }
    this.historyIdx = this.history.length;
  }

  navigateHistory(dir) {
    if (!this.history.length) return;
    this.historyIdx = Math.max(0, Math.min(this.history.length, this.historyIdx + dir));
    this.input.value = this.history[this.historyIdx] || '';
  }

  // --- autocomplete ---

  autocomplete() {
    const val = this.input.value.trim().toLowerCase();
    if (!val) return;
    const match = getMethodNames().find((m) => m.toLowerCase().startsWith(val));
    if (match) this.input.value = match;
  }

  // --- network ---

  switchNetwork(id) {
    this.network = id;
    this.updateNetworkUI();
    const net = networks[this.network];
    this.printLine(`Switched to <span class="text-accent">${net.name}</span> (${net.rpc})`, 'info');
  }

  updateNetworkUI() {
    document.getElementById('btn-testnet').classList.toggle('active', this.network === 'testnet');
    document.getElementById('btn-devnet').classList.toggle('active', this.network === 'devnet');
  }

  // --- chips ---

  renderChips() {
    const container = document.getElementById('chips');
    commands.forEach((cmd) => {
      const el = document.createElement('button');
      el.className = `chip${cmd.category === 'Seismic' ? ' chip-seismic' : ''}`;
      el.dataset.method = cmd.method;
      el.textContent = cmd.chip;
      container.appendChild(el);
    });
  }

  async runChip(method) {
    const cmd = findCommand(method);
    if (!cmd) return;

    if (cmd.params.length === 0) {
      this.printPrompt(method);
      await this.executeRpc(method, []);
    } else {
      this.input.value = method + ' ';
      this.input.focus();
      this.printLine(`<span class="text-muted">${method} requires params: ${cmd.params.map((p) => p.name).join(', ')}</span>`, 'info');
    }
  }

  // --- submit ---

  async submit() {
    const raw = this.input.value.trim();
    if (!raw) return;

    this.input.value = '';
    this.pushHistory(raw);

    // raw JSON mode
    if (raw.startsWith('{')) {
      this.printPrompt(raw.length > 60 ? raw.slice(0, 57) + '...' : raw);
      await this.executeRaw(raw);
      return;
    }

    // meta-commands
    const lower = raw.toLowerCase();
    if (lower === 'help') return this.cmdHelp();
    if (lower === 'clear') return this.cmdClear();
    if (lower === 'history') return this.cmdHistory();
    if (lower === 'info') return this.cmdInfo();
    if (lower.startsWith('network')) return this.cmdNetwork(raw);

    // parse method + args
    const parts = raw.split(/\s+/);
    const method = parts[0];
    const cmd = findCommand(method);

    if (!cmd) {
      this.printPrompt(raw);
      this.printLine(`Unknown command: <span class="text-error">${this.esc(method)}</span>. Type <span class="text-accent">help</span> for available commands.`, 'error');
      return;
    }

    const args = parts.slice(1);
    const params = this.buildParams(cmd, args);
    if (params === null) return; // missing required params, message already printed

    this.printPrompt(raw);
    await this.executeRpc(method, params);
  }

  buildParams(cmd, args) {
    const params = [];
    for (let i = 0; i < cmd.params.length; i++) {
      const p = cmd.params[i];
      let val = args[i];

      if (val === undefined) {
        if (p.required) {
          this.printPrompt(`${cmd.method} ${args.join(' ')}`.trim());
          this.printLine(`Missing required param: <span class="text-accent">${p.name}</span> (${p.placeholder})`, 'error');
          this.input.value = cmd.method + ' ' + args.join(' ') + ' ';
          this.input.focus();
          return null;
        }
        val = p.default;
      }

      if (p.type === 'boolean') {
        val = val === true || val === 'true';
      }

      params.push(val);
    }
    return params;
  }

  // --- RPC execution ---

  async executeRpc(method, params) {
    this.setLoading(true);
    const net = networks[this.network];
    const result = await rpcCall(net.rpc, method, params);
    this.setLoading(false);
    this.renderResult(result, method);
  }

  async executeRaw(payload) {
    this.setLoading(true);
    const net = networks[this.network];
    const result = await rawRpcCall(net.rpc, payload);
    this.setLoading(false);
    this.renderResult(result, null);
  }

  renderResult(result, method) {
    const latencyClass = result.ms < 200 ? 'latency-fast' : result.ms < 1000 ? 'latency-med' : 'latency-slow';

    if (!result.ok) {
      this.printBlock(`
        <div class="result-header">
          <span class="text-error">Error</span>
          <span class="latency ${latencyClass}">${result.ms}ms</span>
        </div>
        <div class="result-body text-error">${this.esc(result.error)}</div>
      `);
      return;
    }

    const json = result.data;
    const hasError = json.error;
    const highlighted = highlightJSON(json);

    let decoded = '';
    if (!hasError && json.result !== undefined && method) {
      const cmd = findCommand(method);
      if (cmd?.decode) {
        try {
          const d = cmd.decode(json.result);
          if (d) decoded = `<div class="decoded">Decoded: ${this.esc(d)}</div>`;
        } catch { /* skip decode errors */ }
      }
    }

    const resultId = 'r' + Date.now();

    this.printBlock(`
      <div class="result-header">
        <span class="${hasError ? 'text-error' : 'text-success'}">Response</span>
        <span class="latency ${latencyClass}">${result.ms}ms</span>
        <button class="copy-btn" data-target="${resultId}" title="Copy JSON">Copy</button>
      </div>
      <pre class="result-body" id="${resultId}">${highlighted}</pre>
      ${decoded}
    `);

    // wire copy button
    const btn = this.output.querySelector(`[data-target="${resultId}"]`);
    btn?.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(json, null, 2)).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 1500);
      });
    });
  }

  // --- meta-commands ---

  cmdHelp() {
    this.printPrompt('help');
    const methods = commands.map((c) => {
      const p = c.params.length ? c.params.map((p) => p.name).join(', ') : 'none';
      const cat = c.category === 'Seismic' ? `<span class="text-seismic">[${c.category}]</span>` : `<span class="text-muted">[${c.category}]</span>`;
      return `  <span class="text-accent">${c.method}</span> ${cat} — params: ${p}`;
    });
    this.printBlock(`
      <div class="help-text">
<b>RPC Commands:</b>
${methods.join('\n')}

<b>Meta Commands:</b>
  <span class="text-accent">help</span>      — show this help
  <span class="text-accent">clear</span>     — clear terminal
  <span class="text-accent">history</span>   — show command history
  <span class="text-accent">info</span>      — show network info
  <span class="text-accent">network</span> &lt;testnet|devnet&gt; — switch network

<b>Raw JSON:</b>
  Paste a full JSON-RPC payload: {"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}
      </div>
    `);
  }

  cmdClear() {
    this.output.innerHTML = '';
    this.printWelcome();
  }

  cmdHistory() {
    this.printPrompt('history');
    if (!this.history.length) {
      this.printLine('<span class="text-muted">No history yet.</span>', 'info');
      return;
    }
    const lines = this.history.slice(-20).map((h, i) => `  <span class="text-muted">${i + 1}.</span> ${this.esc(h)}`);
    this.printBlock(`<div class="help-text">${lines.join('\n')}</div>`);
  }

  cmdInfo() {
    this.printPrompt('info');
    const net = networks[this.network];
    this.printBlock(`
      <div class="help-text">
  <b>Network:</b>  ${net.name}
  <b>RPC:</b>      ${net.rpc}
  <b>Chain ID:</b>  ${net.chainId}
  <b>Explorer:</b>  <a href="${net.explorer}" target="_blank" rel="noopener">${net.explorer}</a>
  <b>Faucet:</b>    <a href="${net.faucet}" target="_blank" rel="noopener">${net.faucet}</a>
      </div>
    `);
  }

  cmdNetwork(raw) {
    const parts = raw.split(/\s+/);
    const target = parts[1]?.toLowerCase();
    if (target === 'testnet' || target === 'devnet') {
      this.printPrompt(raw);
      this.switchNetwork(target);
    } else {
      this.printPrompt(raw);
      this.printLine(`Usage: <span class="text-accent">network</span> &lt;testnet|devnet&gt;`, 'error');
    }
  }

  // --- output helpers ---

  printWelcome() {
    const net = networks[this.network];
    this.printBlock(`
<span class="text-accent"><b>Seismic RPC Sandbox</b></span> <span class="text-muted">v1.0</span>
Connected to: <span class="text-accent">${net.name}</span> (Chain ID: ${net.chainId})
RPC: <span class="text-muted">${net.rpc}</span>
Type <span class="text-accent">help</span> for available commands, or click a chip above.
    `);
  }

  printPrompt(text) {
    const line = document.createElement('div');
    line.className = 'output-line prompt-echo';
    line.innerHTML = `<span class="prompt-prefix">seismic&gt;</span> ${this.esc(text)}`;
    this.output.appendChild(line);
    this.scrollBottom();
  }

  printLine(html, type = '') {
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.innerHTML = html;
    this.output.appendChild(line);
    this.scrollBottom();
  }

  printBlock(html) {
    const block = document.createElement('div');
    block.className = 'output-block';
    block.innerHTML = html;
    this.output.appendChild(block);
    this.scrollBottom();
  }

  scrollBottom() {
    this.output.scrollTop = this.output.scrollHeight;
  }

  setLoading(on) {
    this.input.disabled = on;
    this.runBtn.disabled = on;
    if (on) {
      this.printLine('<span class="text-muted loading-dots">Sending request</span>', 'info');
    }
  }

  esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
