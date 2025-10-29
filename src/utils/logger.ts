type LogFn = (...args: any[]) => void;

const isDev = (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'development')
  || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

const noop: LogFn = () => {};

export const logger = {
  debug: isDev ? console.log.bind(console) : noop,
  error: console.error.bind(console),
  warn: isDev ? console.warn.bind(console) : noop,
};


