import { useMemo, useState, type KeyboardEvent } from "react";

import "../style/App.css";

import { Button } from "./components/Button";
import { BreadCrumbs } from "./components/BreadCrumbs";
import { DictionaryView } from "./components/Dictionary";
import { DropZone } from "./components/DropeZone";
import { Preloader } from "./components/Loader";
import { Modal } from "./components/Modal";
import { PdfObjectItem } from "./components/ObjectItem";
import { PdfValue } from "./components/PdfValue";
import { StreamView } from "./components/Stream";

import { useObjectNavigation } from "./features/ObjectNavigation/index.ts";

import { parse, type PDFObject } from "./reader";

type DictionaryObject = Extract<PDFObject, { type: "dictionary" }>;

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

function getObjectDictionary(value: PDFObject): DictionaryObject | null {
  if (value.type === "dictionary") {
    return value;
  }

  if (value.type === "stream") {
    return value.dictionary;
  }

  return null;
}

function getDictionaryName(dictionary: DictionaryObject, key: string): string | null {
  const entry = dictionary.entries.get(key) ?? dictionary.entries.get(`/${key}`);

  return entry?.type === "name" ? entry.value : null;
}

function getObjectType(value: PDFObject): string | null {
  const dictionary = getObjectDictionary(value);

  if (!dictionary) {
    return null;
  }

  const type = getDictionaryName(dictionary, "Type");
  const subtype = getDictionaryName(dictionary, "Subtype");

  if (type && subtype) {
    return `${type} / ${subtype}`;
  }

  if (type) {
    return type;
  }

  if (subtype) {
    return `Subtype / ${subtype}`;
  }

  return null;
}

function getHeaderType(value: PDFObject, pdfType: string | null): string | null {
  if (value.type === "dictionary" || value.type === "stream") {
    return pdfType ? `${pdfType} (${value.type})` : null;
  }

  return `— (${value.type})`;
}

function App() {
  const [modalOpen, setModalOpen] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [objects, setObjects] = useState<PdfListItem[]>([]);

  const [filter, setFilter] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const { navigate, reset, history, currentObject } = useObjectNavigation(objects);

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

  const tabbableObjectId =
    filteredObjects.find((item) => item.id === currentObject?.id)?.id ??
    filteredObjects[0]?.id ??
    null;

  const currentDictionary = currentObject ? getObjectDictionary(currentObject.value) : null;

  const currentHeaderType = currentObject
    ? getHeaderType(currentObject.value, currentObject.pdfType)
    : null;

  const handleObjectListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-pdf-object-item]"),
    );

    if (buttons.length === 0) {
      return;
    }

    const currentButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-pdf-object-item]",
    );

    if (!currentButton) {
      return;
    }

    const currentIndex = buttons.indexOf(currentButton);

    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
        break;

      case "ArrowUp":
        nextIndex = Math.max(currentIndex - 1, 0);
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = buttons.length - 1;
        break;
    }

    event.preventDefault();

    if (nextIndex === currentIndex) {
      return;
    }

    const nextButton = buttons[nextIndex];

    nextButton.focus();

    nextButton.click();

    nextButton.scrollIntoView({
      block: "nearest",
    });
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    setError(null);

    if (file.type !== "application/pdf") {
      setError("Можно загружать только PDF-файлы");
      return;
    }

    try {
      setIsLoading(true);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      const buf = await file.bytes();

      const doc = parse(buf);

      const items: PdfListItem[] = Array.from(doc.objects.entries()).map(
        ([id, indirectObject]) => ({
          id,
          objectNumber: indirectObject.objectNumber,
          generation: indirectObject.generation,
          kind: getObjectKind(indirectObject.value),
          pdfType: getObjectType(indirectObject.value),
          value: indirectObject.value,
        }),
      );

      setObjects(items);
      reset();
      setPdfFile(file);

      setModalOpen(false);
    } catch (error) {
      console.error("Ошибка загрузки PDF:", error);

      setError("Не удалось открыть PDF. Файл повреждён или имеет некорректную структуру.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    setError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setError(null);
  };

  const handleReferenceClick = (objectNumber: number, generation: number) => {
    navigate({
      type: "reference",
      objectNumber,
      generation,
    });
  };

  return (
    <div className="app">
      {/* HEADER */}

      <div className="toolbar">
        <div className="toolbar__left">
          <div className="toolbar__logo">PDF Inspector</div>

          {pdfFile && <div className="toolbar__file">{pdfFile.name}</div>}
        </div>

        <div className="toolbar__right">
          {isLoading && <Preloader />}

          <Button size="big" variant="contained" text="+ Add PDF" onClick={handleOpenModal} />
        </div>

        <Modal open={modalOpen} onClose={handleCloseModal}>
          <h2>Добавить PDF</h2>

          <DropZone accept="application/pdf" onChange={handleFileChange} />

          {error && <div className="pdfError">{error}</div>}

          {pdfFile && !error && <p>Выбран файл: {pdfFile.name}</p>}
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
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search objects..."
            />
          </div>

          <div className="objectList" onKeyDown={handleObjectListKeyDown}>
            {filteredObjects.map((item) => (
              <PdfObjectItem
                key={item.id}
                objectNumber={item.objectNumber}
                generation={item.generation}
                type={item.kind}
                pdfType={item.pdfType}
                active={currentObject?.id === item.id}
                tabIndex={item.id === tabbableObjectId ? 0 : -1}
                onClick={() =>
                  navigate({
                    type: "object",
                    object: item,
                  })
                }
              />
            ))}
          </div>
        </aside>

        <div className="fullScreen">
          {/* BREAD CRUMBS */}
          <div>
            <BreadCrumbs
              items={history}
              activeItem={currentObject}
              getLabel={(item) => `${item.objectNumber} ${item.generation} R`}
              onSelect={(item) =>
                navigate({
                  type: "history",
                  object: item,
                })
              }
            />
          </div>

          {/* OBJECT SCREEN */}

          <div className="screen">
            {currentObject ? (
              <div>

                <h2>
                  Object {currentObject.objectNumber} {currentObject.generation} R
                </h2>

                {currentHeaderType && <p>{currentHeaderType}</p>}

                <div
                  style={{
                    marginTop: 12,
                    textAlign: "left",
                  }}
                >
                  {currentDictionary ? (
                    <>
                      <DictionaryView
                        value={currentDictionary}
                        onReferenceClick={handleReferenceClick}
                      />

                      {currentObject.value.type === "stream" && (
                        <StreamView value={currentObject.value} />
                      )}
                    </>
                  ) : (
                    <PdfValue value={currentObject.value} onReferenceClick={handleReferenceClick} />
                  )}
                </div>
              </div>
            ) : (
              <p>Выберите объект</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
