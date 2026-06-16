import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dreamRouter from "./dream";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dreamRouter);

export default router;
