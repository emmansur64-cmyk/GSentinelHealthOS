export function createNotifier(wss) {
  return {
    emit(payload) {
      if (!wss) return;
      const message = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    },
  };
}
