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
          <h2>Мое окно</h2>

          <p>Какой-то контент</p>

          <Button size="big" variant="contained" text="Add" onClick={handleCloseModal}>
          </Button>
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
