import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dreamRouter from "./dream";
import wishesRouter from "./wishes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dreamRouter);
router.use(wishesRouter);

export default router;
