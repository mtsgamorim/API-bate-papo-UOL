import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import chalk from "chalk";
import dayjs from "dayjs";

dotenv.config();

const app = express();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("bate_papo_uol");
});

app.post("/participants", async (req, res) => {
  const userSchema = joi.object({
    name: joi.string().required(),
  });
  const nomeUsuario = req.body;
  const validation = userSchema.validate(nomeUsuario, { abortEarly: false });
  if (validation.error) {
    res.status(422).send();
    return;
  }
  try {
    const temUsuarioIgual = await db
      .collection("participantes")
      .find(nomeUsuario)
      .toArray();
    console.log(temUsuarioIgual);
    if (temUsuarioIgual.length !== 0) {
      res.status(409).send();
      return;
    }
    db.collection("participantes").insertOne({
      name: nomeUsuario.name,
      lastStatus: Date.now(),
    });
    db.collection("mensagens").insertOne({
      from: nomeUsuario.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.status(201).send();
  } catch (error) {
    res.status(500).send();
  }
});

app.listen(5000, () => {
  console.log(chalk.bold.blue("Servidor funcionando na porta 5000"));
});
