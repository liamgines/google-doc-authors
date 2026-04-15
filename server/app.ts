import express, { type Request, type Response } from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT;

app.use(cors());

app.get("/api", (req: Request, res: Response) => {
    res.json({ message: "Hello world!" });
});

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
