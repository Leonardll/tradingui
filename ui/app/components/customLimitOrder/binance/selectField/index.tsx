interface SelectFieldProps {
    value: string
    options: Array<{ label: string; value: string }>
    onChange: (value: string) => void
}

const SelectField: React.FC<SelectFieldProps> = ({ value, options, onChange }) => {
    return (
        <select
            className="p-2"
            value={value}
            onChange={(e) => onChange(e.target.value)} // Adjust this line
        >
            {options.map((option, index) => (
                <option key={index} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    )
}

export default SelectField
