import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(
    typeof __dirname !== "undefined" ? __dirname : path.dirname(""),
    "public",
  );
  app.use(express.static(publicDir));
  app.get("{*path}", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
