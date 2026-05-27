import React, { useState } from 'react';
import { getTagColors } from '../../lib/color-utils';

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  const colors = getTagColors();
  const [hexInput, setHexInput] = useState(selectedColor);

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (HEX_REGEX.test(value)) {
      onSelect(value.toLowerCase());
    }
  };

  const handleNativeChange = (value: string) => {
    setHexInput(value);
    onSelect(value);
  };

  return (
    <div className="color-picker-container">
      <div className="color-picker">
        {colors.map(color => (
          <button
            key={color}
            className={`color-swatch${color === selectedColor ? ' selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => { onSelect(color); setHexInput(color); }}
            title={color}
          />
        ))}
      </div>
      <div className="color-picker-custom">
        <input
          type="color"
          className="color-picker-native"
          value={selectedColor}
          onChange={e => handleNativeChange(e.target.value)}
        />
        <input
          type="text"
          className="input color-picker-hex-input"
          value={hexInput}
          onChange={e => handleHexChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
        />
      </div>
    </div>
  );
}
