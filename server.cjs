const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3001;

const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + ".pdf";

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только PDF"));
    }
  },
});

app.post(
  "/upload",

  upload.single("pdf"),

  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: "Файл не получен",
      });
    }

    console.log("Файл сохранён:");
    console.log(req.file);

    res.json({
      message: "PDF успешно сохранён",
      file: req.file.filename,
    });
  }
);

app.use((error, req, res, next) => {
  console.error("Ошибка сервера:", error);

  res.status(400).json({
    message: error.message,
  });
});

app.listen(PORT, () => {
  console.log(
    `Server started: http://localhost:${PORT}`
  );
});