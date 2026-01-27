import { Router } from "express";
import authRoutes from "./auth.routes";
import siteRoutes from "./site.routes";
import cameraRoutes from "./camera.routes";
import discoveryRoutes from "./discovery.routes";
import streamRoutes from "./stream.routes";
import alarmRoutes from "./alarm.routes";
import reportRoutes from "./report.routes";
import motionDetectionRoutes from "./motion-detection.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/sites", siteRoutes);
router.use("/cameras", cameraRoutes);
router.use("/discovery", discoveryRoutes);
router.use("/stream", streamRoutes);
router.use("/alarms", alarmRoutes);
router.use("/reports", reportRoutes);
router.use("/motion-detection", motionDetectionRoutes);

export default router;
