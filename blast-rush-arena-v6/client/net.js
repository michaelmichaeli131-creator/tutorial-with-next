(() => {
  'use strict';

  class BlastNetwork extends EventTarget {
    constructor() {
      super();
      this.socket = null;
      this.playerId = localStorage.getItem('blastRushPlayerId') || '';
      this.playerName = localStorage.getItem('blastRushPlayerName') || `Pilot-${Math.floor(100 + Math.random() * 900)}`;
      this.skin = localStorage.getItem('blastRushSkin') || 'nova';
      this.connected = false;
      this.ready = false;
      this.connecting = null;
      this.readyPromise = null;
      this.readyResolve = null;
      this.seq = 0;
      this.latency = 0;
      this.reconnectTimer = null;
      this.intentionalClose = false;
      this.pendingAction = null;
    }

    setName(name) {
      const clean = String(name || '').replace(/[^\p{L}\p{N}_\- .]/gu, '').trim().slice(0, 18) || 'Pilot';
      this.playerName = clean;
      localStorage.setItem('blastRushPlayerName', clean);
      this.updateProfile();
      return clean;
    }

    setSkin(skin) {
      const clean = /^[a-z0-9_-]{1,24}$/.test(String(skin || '')) ? String(skin) : 'nova';
      this.skin = clean;
      localStorage.setItem('blastRushSkin', clean);
      this.updateProfile();
      return clean;
    }

    updateProfile() {
      if (this.ready) this.send({ type: 'hello', playerId: this.playerId, name: this.playerName, skin: this.skin });
    }

    resetReadyPromise() {
      this.readyPromise = new Promise((resolve) => { this.readyResolve = resolve; });
    }

    async connect() {
      if (this.ready && this.socket?.readyState === WebSocket.OPEN) return true;
      if (this.connecting) return this.connecting;
      this.intentionalClose = false;
      this.ready = false;
      this.resetReadyPromise();
      this.connecting = new Promise((resolve) => {
        const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${scheme}//${location.host}/ws`);
        this.socket = socket;
        const timeout = setTimeout(() => {
          if (!this.ready) {
            socket.close();
            resolve(false);
          }
        }, 8000);

        socket.addEventListener('open', () => {
          this.connected = true;
          this.send({ type: 'hello', playerId: this.playerId || undefined, name: this.playerName, skin: this.skin });
          this.emit('connection', { connected: true, ready: false });
          this.startPing();
        });

        socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'welcome') {
              this.playerId = message.playerId;
              this.playerName = message.name || this.playerName;
              this.skin = message.skin || this.skin;
              this.ready = true;
              localStorage.setItem('blastRushPlayerId', this.playerId);
              localStorage.setItem('blastRushPlayerName', this.playerName);
              localStorage.setItem('blastRushSkin', this.skin);
              clearTimeout(timeout);
              this.readyResolve?.(true);
              this.readyResolve = null;
              this.emit('connection', { connected: true, ready: true });
              resolve(true);
            }
            if (message.type === 'pong') this.latency = Math.max(0, Date.now() - message.at);
            this.emit(message.type, message);
            this.emit('message', message);
          } catch (error) {
            console.warn('Invalid server message', error);
          }
        });

        const close = () => {
          clearTimeout(timeout);
          this.connected = false;
          this.ready = false;
          this.connecting = null;
          this.readyResolve?.(false);
          this.readyResolve = null;
          this.stopPing();
          this.emit('connection', { connected: false, ready: false });
          if (!this.intentionalClose) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 1200);
          }
          resolve(false);
        };
        socket.addEventListener('close', close, { once: true });
        socket.addEventListener('error', () => socket.close(), { once: true });
      }).finally(() => { this.connecting = null; });
      return this.connecting;
    }

    disconnect() {
      this.intentionalClose = true;
      clearTimeout(this.reconnectTimer);
      this.socket?.close();
    }

    quickMatch() { return this.command({ type: 'quick_match' }, 'quick_match'); }
    createRoom(options = {}) { return this.command({ type: 'create_room', visibility: options.visibility || 'private', tableName: options.tableName || '' }, 'create_room'); }
    joinRoom(code) { return this.command({ type: 'join_room', code: String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) }, 'join_room'); }
    rematch() { return this.command({ type: 'rematch' }, 'rematch'); }
    leave() { this.pendingAction = null; return this.command({ type: 'leave' }); }

    score(delta, event, combo, wave) {
      if (!this.ready) return false;
      return this.send({ type: 'score', seq: ++this.seq, delta: Math.floor(delta), event, combo, wave });
    }

    pressure() {
      if (!this.ready) return false;
      return this.send({ type: 'pressure', seq: ++this.seq });
    }

    launchCore() {
      if (!this.ready) return false;
      return this.send({ type: 'launch_core', seq: ++this.seq });
    }

    async command(payload, action = null) {
      if (action && this.pendingAction === action) return false;
      if (action) this.pendingAction = action;
      try {
        if (!(await this.connect())) return false;
        if (!this.ready && !(await this.readyPromise)) return false;
        return this.send(payload);
      } finally {
        if (action) setTimeout(() => { if (this.pendingAction === action) this.pendingAction = null; }, 700);
      }
    }

    send(payload) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
      this.socket.send(JSON.stringify(payload));
      return true;
    }

    async tables() {
      const response = await fetch('/api/tables', { cache: 'no-store' });
      if (!response.ok) throw new Error('Public tables unavailable');
      return response.json();
    }

    async createChallenge(result) {
      return this.post('/api/challenges', { creatorName: this.playerName, score: result.score, wave: result.wave, perfects: result.perfects, maxCombo: result.maxCombo, stage: result.stage, seed: result.seed });
    }

    async getChallenge(code) {
      const response = await fetch(`/api/challenges/${encodeURIComponent(code)}`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Challenge not found');
      return response.json();
    }

    async submitChallenge(code, result) {
      return this.post(`/api/challenges/${encodeURIComponent(code)}/attempt`, { name: this.playerName, score: result.score, wave: result.wave, perfects: result.perfects, maxCombo: result.maxCombo });
    }

    async leaderboard() {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Leaderboard unavailable');
      return response.json();
    }

    async post(path, body) {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Request failed');
      return payload;
    }

    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
    startPing() { this.stopPing(); this.pingTimer = setInterval(() => this.send({ type: 'ping', at: Date.now() }), 5000); }
    stopPing() { clearInterval(this.pingTimer); }
  }

  window.BlastNetwork = new BlastNetwork();
})();