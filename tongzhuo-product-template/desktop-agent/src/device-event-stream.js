function parsePayload(value) {
  const text = String(value || '');
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeLine(line) {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

/**
 * Consume a standards-compatible Server-Sent Events response. The publisher
 * stream transports wake-up hints only, never article payloads or credentials.
 */
export async function consumeSseResponse(response, onEvent, options = {}) {
  if (!response?.body || typeof response.body.getReader !== 'function') {
    throw new Error('Publisher event stream response has no readable body');
  }
  if (typeof onEvent !== 'function') throw new Error('Publisher event stream requires an event handler');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const signal = options.signal;
  const abortReader = () => {
    reader.cancel(signal?.reason).catch(() => {});
  };
  if (signal?.aborted) abortReader();
  else signal?.addEventListener('abort', abortReader, { once: true });

  let buffer = '';
  let eventName = 'message';
  let eventId = '';
  let data = [];

  const dispatch = async () => {
    if (!data.length) {
      eventName = 'message';
      eventId = '';
      return;
    }
    const rawData = data.join('\n');
    const event = {
      event: eventName || 'message',
      id: eventId || null,
      data: parsePayload(rawData),
      rawData,
    };
    eventName = 'message';
    eventId = '';
    data = [];
    await onEvent(event);
  };

  const processLine = async (input) => {
    const line = normalizeLine(input);
    if (line === '') {
      await dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') eventName = value || 'message';
    else if (field === 'id') eventId = value;
    else if (field === 'data') data.push(value);
  };

  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        await processLine(line);
      }
    }
    buffer += decoder.decode();
    if (buffer !== '') await processLine(buffer);
    await dispatch();
  } finally {
    signal?.removeEventListener('abort', abortReader);
    reader.releaseLock();
  }
}
