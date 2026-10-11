export interface ZoneRowProps {
  zone: string;
  from: number;
  to: number;
  onRangeChange: (from: number, to: number) => void;
  onRemove: () => void;
}

const START_HOURS = Array.from({ length: 24 }, (_, hour) => String(hour));

export function ZoneRow({ zone, from, to, onRangeChange, onRemove }: ZoneRowProps) {
  return (
    <div className="zone-row">
      <strong className="zone-row__name">{zone}</strong>
      <label>
        <span>From</span>
        <select
          aria-label={`${zone} from`}
          value={from}
          onChange={(event) => onRangeChange(Number(event.target.value), to)}
        >
          {START_HOURS.map((hourText) => {
            const hour = Number(hourText);
            return (
              <option key={hourText} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            );
          })}
        </select>
      </label>
      <label>
        <span>To</span>
        <select
          aria-label={`${zone} to`}
          value={to}
          onChange={(event) => onRangeChange(from, Number(event.target.value))}
        >
          {Array.from({ length: 24 }, (_, index) => {
            const hour = index + 1;
            return (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            );
          })}
        </select>
      </label>
      <button type="button" className="button button--quiet" onClick={onRemove}>
        Remove
      </button>
      {from >= to && <span className="zone-row__error">Start must be before end</span>}
    </div>
  );
}
