import { useState } from "react";
import "../style/App.css";
import { Button } from "./components/Button";
import { Stack } from "./components/Stack";
import { Switch } from "./components/Switch";
import { Tabs } from "./components/Tabs";
import { Tab } from "./components/Tabs";
import { Preloader } from "./components/Loader";
import { Accordion } from "./components/Accordion";
import { AccordionItem } from "./components/Accordion";
import { ToggleButton } from "./components/ToggleButton";
import { ToggleButtonGroup } from "./components/ToggleButton";
import { TreeContainer } from "./components/Tree";
import { TreeNode } from "./components/Tree";
import { Modal } from "./components/Modal";

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Можно загружать только PDF");
      return;
    }

    setPdfFile(file);
  };

  const handleSavePdf = async () => {
    if (!pdfFile) {
      alert("Сначала выберите PDF файл");
      return;
    }

    const formData = new FormData();

    formData.append("pdf", pdfFile);

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Ошибка загрузки");
      }

      const data = await response.json();

      console.log(data);

      alert("PDF сохранён");

      setPdfFile(null);
      handleCloseModal();
    } catch (error) {
      console.error(error);
      alert("Не удалось сохранить PDF");
    }
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
        <Button size="big" variant="contained" text="Add" onClick={handleOpenModal}>
        </Button>

        <Modal
          open={modalOpen}
          onClose={handleCloseModal}
        >
          <h2>Добавить PDF</h2>

          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />

          {pdfFile && (
            <p>
              Выбран файл: {pdfFile.name}
            </p>
          )}

          <Button
            size="big"
            variant="contained"
            text="Сохранить"
            onClick={handleSavePdf}
          />
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
        <Stack direction="column" spacing={1} sx={{ width: 300, height: "100%", overflow: "auto" }}>
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
          <Preloader />
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
