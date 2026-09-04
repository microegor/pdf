import { useMemo, useState } from "react";

import "../style/App.css";

import { Button } from "./components/Button";
import { BreadCrumbs } from "./components/BreadCrumbs";
import { DropZone } from "./components/DropeZone";
import { Preloader } from "./components/Loader";
import { Modal } from "./components/Modal";
import { PdfObjectItem } from "./components/ObjectItem";
import { PdfValue } from "./components/PdfValue";
import { Stack } from "./components/Stack";
import { StreamView } from "./components/Stream";

import { parse, type PDFObject } from "./reader";

type PdfListItem = {
  id: string;
  objectNumber: number;
  generation: number;
  kind: string;
  pdfType: string | null;
  value: PDFObject;
};

function getObjectKind(value: PDFObject): string {
  if (value.type === "dictionary") {
    return "[D]";
  }

  if (value.type === "stream") {
    return "[S]";
  }

  return value.type.charAt(0).toUpperCase();
}

function getObjectType(value: PDFObject): string | null {
  if (value.type === "dictionary") {
    const typeEntry = value.entries.get("Type") ?? value.entries.get("/Type");

    if (typeEntry?.type === "name") {
      return typeEntry.value;
    }
  }

  if (value.type === "stream") {
    const typeEntry = value.dictionary.entries.get("Type") ?? value.dictionary.entries.get("/Type");

    if (typeEntry?.type === "name") {
      return typeEntry.value;
    }
  }

  return null;
}

function App() {
  const [modalOpen, setModalOpen] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [objects, setObjects] = useState<PdfListItem[]>([]);

  const [selectedObject, setSelectedObject] = useState<PdfListItem | null>(null);

  const [filter, setFilter] = useState("");

  const [history, setHistory] = useState<PdfListItem[]>([]);

  const [historyIndex, setHistoryIndex] = useState(-1);

  const filteredObjects = useMemo(() => {
    const query = filter.trim().toLowerCase();

    if (!query) {
      return objects;
    }

    return objects.filter((item) => {
      const searchableText = [
        item.objectNumber,
        item.generation,
        `${item.objectNumber} ${item.generation} R`,
        item.kind,
        item.pdfType,
        item.value.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [objects, filter]);

  const handleObjectSelect = (item: PdfListItem) => {
    setSelectedObject(item);

    setHistory([item]);
    setHistoryIndex(0);
  };

  const handleReferenceClick = (objectNumber: number, generation: number) => {
    const target = objects.find(
      (item) => item.objectNumber === objectNumber && item.generation === generation,
    );

    if (!target) {
      console.warn(`Object ${objectNumber} ${generation} R not found`);

      return;
    }

    /**
     * Если пользователь сначала вернулся назад:
     *
     * 1 / 5 / 12 / 20
     *     ↑
     *
     * а потом из 5 перешёл в 30,
     *
     * получаем:
     *
     * 1 / 5 / 30
     *
     * а не:
     *
     * 1 / 5 / 12 / 20 / 30
     */
    const newHistory = history.slice(0, historyIndex + 1);

    newHistory.push(target);

    setHistory(newHistory);

    setHistoryIndex(newHistory.length - 1);

    setSelectedObject(target);
  };

  const handleBreadCrumbSelect = (id: string) => {
    const index = Number(id);

    if (Number.isNaN(index)) {
      return;
    }

    const target = history[index];

    if (!target) {
      return;
    }

    setHistoryIndex(index);

    setSelectedObject(target);
  };

  const breadCrumbItems = history.map((item, index) => ({
    id: String(index),
    label: `${item.objectNumber} ${item.generation} R`,
  }));

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Можно загружать только PDF");

      return;
    }

    const buf = await file.bytes();

    const doc = parse(buf);

    const items: PdfListItem[] = Array.from(doc.objects.entries()).map(([id, indirectObject]) => ({
      id,

      objectNumber: indirectObject.objectNumber,

      generation: indirectObject.generation,

      kind: getObjectKind(indirectObject.value),

      pdfType: getObjectType(indirectObject.value),

      value: indirectObject.value,
    }));

    setObjects(items);

    // Загружается новый PDF —
    // очищаем выбранный объект и старую историю.
    setSelectedObject(null);

    setHistory([]);

    setHistoryIndex(-1);

    setPdfFile(file);

    console.log(doc);
    console.log("Полученный PDF:", file);
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <div className="app">
      {/* HEADER */}

      <div className="toolbar">
        <div className="toolbar__left">
          <div className="toolbar__logo">
            PDF Inspector
          </div>

          {pdfFile && (
            <div className="toolbar__file">
              {pdfFile.name}
            </div>
          )}
        </div>

        <div className="toolbar__right">
          <Preloader />

          <Button
            size="big"
            variant="contained"
            text="+ Add PDF"
            onClick={handleOpenModal}
          />
        </div>

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
            <p>Выбран файл: {pdfFile.name}</p>
          )}
        </Modal>
      </div>

      {/* MAIN */}

      <main className="main">
        {/* LEFT SIDEBAR */}

        <aside className="sidebar">
          <div className="searchBox">
            <input
              className="searchInput"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              placeholder="Search objects..."
            />
          </div>

          <div className="objectList">
            {filteredObjects.map((item) => (
              <PdfObjectItem
                key={item.id}
                objectNumber={item.objectNumber}
                generation={item.generation}
                type={item.kind}
                pdfType={item.pdfType}
                active={
                  selectedObject?.id === item.id
                }
                onClick={() =>
                  handleObjectSelect(item)
                }
              />
            ))}
          </div>
        </aside>

        {/* OBJECT SCREEN */}

        <div className="screen">
          {selectedObject ? (
            <div>
              <BreadCrumbs
                items={breadCrumbItems}
                activeId={String(historyIndex)}
                onSelect={handleBreadCrumbSelect}
              />

              <h2>
                Object {selectedObject.objectNumber}{" "}
                {selectedObject.generation} R
              </h2>

              <p>
                Generation: {selectedObject.generation}
              </p>

              <p>
                Type: {selectedObject.pdfType ?? "—"} (
                {selectedObject.value.type})
              </p>

              <div
                style={{
                  marginTop: 12,
                  textAlign: "left",
                }}
              >
                {selectedObject.value.type === "stream" ? (
                  <StreamView
                    value={selectedObject.value}
                    onReferenceClick={handleReferenceClick}
                  />
                ) : (
                  <PdfValue
                    value={selectedObject.value}
                    onReferenceClick={handleReferenceClick}
                  />
                )}
              </div>
            </div>
          ) : (
            <p>Выберите объект</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
