import express, { type Request, type Response } from "express";
const app = express();
const port = process.env.PORT;

app.get("/", (req: Request, res: Response) => {
    res.send("Hello world!");
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
