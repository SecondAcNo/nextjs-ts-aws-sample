import { startServer } from "./http/server";

const port = Number(process.env.PORT ?? 4000);

startServer(port);
