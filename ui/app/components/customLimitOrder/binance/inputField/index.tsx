interface InputFieldProps {
    type: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

const InputField: React.FC<InputFieldProps> = ({
    type,
    placeholder,
    value,
    onChange,
    disabled,
}) => {
    return (
        <input
            className="p-2"
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
        />
    )
}

export default InputField
