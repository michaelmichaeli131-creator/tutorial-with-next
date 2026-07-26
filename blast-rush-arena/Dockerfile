FROM denoland/deno:2.8.1
WORKDIR /app
COPY deno.json ./
COPY server ./server
COPY client ./client
RUN deno check --unstable-kv server/main.ts
EXPOSE 8000
CMD ["deno", "task", "start"]
