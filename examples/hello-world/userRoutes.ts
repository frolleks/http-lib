import { createRouter } from "pathless";

const router = createRouter();

router.get("/:id", (req, res) => {
  res.json({ userId: req.params?.id });
});

export default router;
