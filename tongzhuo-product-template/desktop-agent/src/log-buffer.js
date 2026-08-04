export class RuntimeLogBuffer {
  constructor(limit = 200) {
    this.limit = limit;
    this.items = [];
  }

  add(level, event, message, context = {}) {
    this.items.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      level,
      event,
      message,
      context,
    });
    this.items = this.items.slice(0, this.limit);
    return this.items[0];
  }

  clear() {
    this.items = [];
    this.add('info', 'logs.cleared', '运行日志已清空。');
    return this.list();
  }

  list() {
    return this.items;
  }
}
