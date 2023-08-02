interface PercentageButtonProps {
    percentage: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, percentage: string) => void;
}

const PercentageButton: React.FC<PercentageButtonProps> = ({ percentage, onClick }) => {
    return (
        <button
            className="bg-blue-500 text-white py-2 px-4 rounded text-center"
            onClick={(event) => onClick(event, percentage)}
        >
            <div className="h-2 bg-blue-500" />
            {percentage}%
        </button>
    );
}


export default PercentageButton;