import RefugeCard from "./RefugeCard";

// AC 2.1.1: sorted by walking time ascending (the API already returns them
// this way — nearby refuges are ordered by distanceMetres). The nearest one
// gets the "Recommended" badge.
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
