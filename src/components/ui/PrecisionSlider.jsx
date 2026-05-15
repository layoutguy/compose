export default function PrecisionSlider({
  min = 0,
  max = 100,
  value,
  step = 1,
  onChange,
}) {
  return (
    <div className="precision-slider-wrap">
      <input
        type="range"
        className="precision-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange?.(Number(e.target.value))}
      />
    </div>
  )
}
