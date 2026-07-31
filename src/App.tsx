import { useState } from "react";
import "../style/App.css";
import { Button } from "./components/Button";
import { Stack } from "./components/Stack";
import { Switch } from "./components/Switch";
import { Splitter, SplitterHandle, SplitterPanel } from "./components/splitter";

function App() {
  const [switchState, setSwitchState] = useState(true);

  return (
    <Stack>
      <Stack direction="row" sx={{ alignItems: "baseline" }}>
        <Button size="big" variant="contained" text="Button" onClick={() => alert("Hello")} />
        <Button disabled size="big" variant="contained" text="Button" />
      </Stack>

      <div>
        <Button size="big" variant="outlined" text="Button" />
        <Button disabled size="big" variant="outlined" text="Button" />
      </div>

      <div>
        <Button size="big" variant="text" text="Button" />
        <Button disabled size="big" variant="text" text="Button" />
      </div>

      <div>
        <Button size="big" variant="contained" text="Button" />
        <Button size="medium" variant="contained" text="Button" />
        <Button size="small" variant="contained" text="Button" />
      </div>
      <div>
        <Switch disabled state />
        <Switch onClick={v => {
          setSwitchState(v); console.log(v)
        }} state={switchState} />
      </div>
      <div className="splitterExample">
        <Splitter direction="horizontal">
          <SplitterPanel>
            Левая панель
          </SplitterPanel>

          <SplitterHandle />

          <SplitterPanel>
            Центральная панель
          </SplitterPanel>

          <SplitterHandle />

          <SplitterPanel>
            <Splitter direction="vertical">
              <SplitterPanel>
                Верхняя панель
              </SplitterPanel>

              <SplitterHandle />

              <SplitterPanel>
                Нижняя панель
              </SplitterPanel>
              <SplitterPanel>
                Нижняя панель
              </SplitterPanel>
              <SplitterPanel>
                Нижняя панель
              </SplitterPanel>
            </Splitter>
          </SplitterPanel>
        </Splitter>
      </div>
    </Stack>
  );
}

export default App;
