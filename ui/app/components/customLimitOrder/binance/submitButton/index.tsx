interface SubmitButtonProps {
    onClick: () => void; // This represents the onClick handler function
    children?: React.ReactNode; // This represents any children elements the component might have
}


const SubmitButton : React.FC < SubmitButtonProps > = ({ onClick , children }) => {

    return (

        <div className="flex flex-col justify-center ">
        <button
            className=" p-2 bg-red-300 text-center"
            onClick={onClick}
            type="submit"
        >
        {children}
        </button>
    </div> 
    )
} ;

export default SubmitButton;