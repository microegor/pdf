import { useState } from "react";
import "../style/App.css";
import { Button } from "./components/Button";
import { Stack } from "./components/Stack";
import { Preloader } from "./components/Loader";
import { Modal } from "./components/Modal";
import { DropZone } from "./components/DropeZone";

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Можно загружать только PDF");
      return;
    }

    setPdfFile(file);

    console.log("Полученный PDF:", file);
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <Stack
      direction="column"
      spacing={0}
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          width: "100%",
          height: 70,
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #ccc",
        }}
      >
        <Button
          size="big"
          variant="contained"
          text="Add"
          onClick={handleOpenModal}
        />

        <Modal
          open={modalOpen}
          onClose={handleCloseModal}
        >
          <h2>Добавить PDF</h2>

          <DropZone
            accept="application/pdf"
            onChange={handleFileChange}
          />
          {pdfFile && (
            <p>
              Выбран файл: {pdfFile.name}
            </p>
          )}
        </Modal>

        <div>
          <Preloader />
        </div>
      </Stack>

      <Stack
        direction="row"
        spacing={0}
        sx={{
          width: "100%",
          flex: 1,
          minHeight: 0,
        }}
      >
        <Stack
          direction="column"
          spacing={1}
          sx={{
            width: 300,
            height: "100%",
            overflow: "auto",
          }}
        >
          <Preloader />
          <Preloader />
          <Preloader />
        </Stack>

        <div className="screen">
          <Preloader />
        </div>
      </Stack>
    </Stack>
  );
}

export default App;