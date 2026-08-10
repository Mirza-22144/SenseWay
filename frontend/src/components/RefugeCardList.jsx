import RefugeCard from "./RefugeCard";

// refuges is already sorted nearest-first by the API; index 0 gets the badge.
export default function RefugeCardList({ refuges, selectedRefugeId, onSelect, onViewDetails }) {
  if (!refuges || refuges.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {refuges.map((refuge, index) => (
        <RefugeCard
          key={refuge.refugeId}
          refuge={refuge}
          isNearest={index === 0}
          isSelected={refuge.refugeId === selectedRefugeId}
          onSelect={onSelect}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
