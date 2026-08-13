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

function App() {
  return (
    <Stack
      direction="column"
      spacing={0}
      sx={{
        width: "100%",
        height: "100%",
      }}
    >
      <div className="toolTab">
        <div>
          <Preloader />
        </div>
      </div>

      <Stack
        direction="row"
        spacing={0}
        sx={{
          width: "100%",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className="container">
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
        </div>

        <div className="screen">
          <Preloader />
        </div>
      </Stack>
    </Stack>
  );
}

export default App;
