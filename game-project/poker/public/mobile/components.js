// Card component for displaying playing cards
const Card = ({ suit, value, revealed }) => {
    if (!revealed) {
        return <div className="card back">🂠</div>;
    }

    const suitSymbol = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
    };

    const cardColor = suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-black';

    return (
        <div className={`card ${cardColor} bg-white rounded-lg p-4 shadow-lg`}>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-2xl">{suitSymbol[suit]}</div>
        </div>
    );
};