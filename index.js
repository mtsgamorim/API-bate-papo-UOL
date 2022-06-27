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

app.get("/participants", async (_, res) => {
  try {
    const listarParticipantes = await db
      .collection("participantes")
      .find()
      .toArray();
    res.send(listarParticipantes);
  } catch (error) {
    res.status(500).send();
  }
});

app.post("/messages", async (req, res) => {
  const mensagemRecebida = req.body;
  const user = req.headers.user;
  const mensagemRecebidaSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
  });
  const validation = mensagemRecebidaSchema.validate(mensagemRecebida, {
    abortEarly: false,
  });
  if (validation.error) {
    res.status(422).send();
    return;
  }
  try {
    const usuarios = await db
      .collection("participantes")
      .find({ name: user })
      .toArray();
    if (!usuarios) {
      res.status(422).send();
      return;
    }
    db.collection("mensagens").insertOne({
      from: user,
      to: mensagemRecebida.to,
      text: mensagemRecebida.text,
      type: mensagemRecebida.type,
      time: dayjs().format("HH:mm:ss"),
    });
  } catch (error) {
    res.status(500).send();
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;
  try {
    const mensagens = await db.collection("mensagens").find().toArray();
    const novasMensagens = mensagens.filter((mensagem) => {
      const { from, to, type } = mensagem;
      const validacao =
        to === user || from === user || to === "Todos" || type === "message";
      return validacao;
    });
    if (limit && limit !== NaN) {
      res.send(novasMensagens.slice(-limit));
    }

    res.send(novasMensagens);
  } catch (error) {
    res.status(500).send();
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    const participantes = await db
      .collection("participantes")
      .findOne({ name: user });
    if (participantes.length === 0) {
      res.status(404).send();
      return;
    }
    await db
      .collection("participantes")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.status(200).send();
  } catch (error) {
    res.status(500).send();
  }
});

const TEMPO_15S = 15 * 1000;
setInterval(async () => {
  const tempoLimite = Date.now() - 10 * 1000;
  try {
    const participantes = await db
      .collection("participantes")
      .find({ lastStatus: { $lte: tempoLimite } })
      .toArray();
    if (participantes.length > 0) {
      const mensagemSaida = participantes.map((pessoa) => {
        return {
          from: pessoa.name,
          to: "Todos",
          text: "sai da sala ...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });
      await db.collection("mensagens").insertMany(mensagemSaida);
      await db
        .collection("participantes")
        .deleteMany({ lastStatus: { $lte: tempoLimite } });
    }
  } catch (error) {
    res.status(500).send();
  }
}, TEMPO_15S);
app.listen(5000, () => {
  console.log(chalk.bold.blue("Servidor funcionando na porta 5000"));
});
