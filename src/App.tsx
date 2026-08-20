import { useState } from "react";
import "../style/App.css";
import { Button } from "./components/Button";
import { Stack } from "./components/Stack";
import { Preloader } from "./components/Loader";
import { Modal } from "./components/Modal";
import { DropZone } from "./components/DropeZone";
import { parse, type PDFObject } from "./reader";
import { PdfObjectItem } from "./components/ObjectItem";

type PdfListItem = {
  id: string;
  objectNumber: number;
  generation: number;
  type: string;
  value: unknown;
};

function ObjectItemClick() {
  alert("You've clicked on object")
}

function getObjectType(value: PDFObject): string {
  if (value.type === "dictionary") {
    const typeEntry =
      value.entries.get("Type") ??
      value.entries.get("/Type");

    if (typeEntry?.type === "name") {
      return typeEntry.value;
    }

    return value.type;
  }

  if (value.type === "stream") {
    const typeEntry =
      value.dictionary.entries.get("Type") ??
      value.dictionary.entries.get("/Type");

    if (typeEntry?.type === "name") {
      return typeEntry.value;
    }

    return value.type;
  }

  return value.type;
}

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [objects, setObjects] = useState<PdfListItem[]>([]);
  const [selectedObject, setSelectedObject] = useState<PdfListItem | null>(null);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Можно загружать только PDF");
      return;
    }


    const buf = await file.bytes();
    const doc = parse(buf);

    const items: PdfListItem[] = Array.from(doc.objects.entries()).map(
      ([id, indirectObject]) => ({
        id,
        objectNumber: indirectObject.objectNumber,
        generation: indirectObject.generation,
        type: getObjectType(indirectObject.value),
        value: indirectObject.value,
      }),
    );

    setObjects(items);

    console.log(doc);
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

          {objects.map((item) => (
            <PdfObjectItem
              key={item.id}
              objectNumber={item.objectNumber}
              generation={item.generation}
              type={item.type}
              active={selectedObject?.id === item.id}
              onClick={() => setSelectedObject(item)}
            />
          ))}
        </Stack>

        <div className="screen">
          {selectedObject ? (
            <div>
              <h2>
                Object {selectedObject.objectNumber}
              </h2>

              <p>Generation: {selectedObject.generation}</p>
              <p>Type: {selectedObject.type}</p>
            </div>
          ) : (
            <p>Выберите объект</p>
          )}
        </div>
      </Stack>
    </Stack>
  );
}

export default App;