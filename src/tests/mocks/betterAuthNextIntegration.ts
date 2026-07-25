export const nextCookies = () => ({
  id: "vitest-next-cookies",
  hooks: { after: [] },
});

export const toNextJsHandler = () => ({
  GET: async () => new Response(null, { status: 200 }),
  POST: async () => new Response(null, { status: 200 }),
});
