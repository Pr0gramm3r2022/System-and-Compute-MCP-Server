import express from 'express';

// Spins up a throwaway Express app with requireAuth in front of one route,
// listening on a random port. Returns the base URL and a close() function.
export async function startApp(requireAuth) {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => res.json({ ok: true, user: req.user ?? null }));
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
