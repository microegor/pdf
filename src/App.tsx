import "../style/App.css";
import { Button } from "./components/Button";
import { Stack } from "./components/Stack/Stack";
import { Switch } from "./components/Switch";

function App() {
  return (
    <Stack>
      <Stack direction="row" sx={{alignItems: "baseline"}}>
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
        <Switch onClick={(v) => alert(`Switched to ${v}`)} state={false} />
      </div>
    </Stack>
  );
}

export default App;
