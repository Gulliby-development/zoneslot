import { type FormEvent, useState } from "react";

export interface AddZoneFormProps {
  error: string | null;
  onAdd: (zone: string) => void;
}

export function AddZoneForm({ error, onAdd }: AddZoneFormProps) {
  const [zone, setZone] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd(zone);
  };

  return (
    <form className="add-zone-form" onSubmit={submit}>
      <label htmlFor="zone-input">Add a time zone</label>
      <div className="add-zone-form__controls">
        <input
          id="zone-input"
          name="zone"
          type="text"
          autoComplete="off"
          placeholder="Europe/Berlin"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
        />
        <button type="submit" className="button">
          Add
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
