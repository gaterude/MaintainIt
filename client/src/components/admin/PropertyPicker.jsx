import { selectProperty, usePropertyFilter } from "./propertyFilter";
import "./PropertyPicker.css";

// One dropdown at the top of the admin pages that need it. Choosing a property
// limits the numbers and lists on the page to that property.
export default function PropertyPicker() {
  const { properties, propertyId, selected, loaded } = usePropertyFilter();

  if (loaded && properties.length < 2) return null; // nothing to choose between

  return (
    <div className="pk-bar">
      <label>
        Property
        <select
          value={propertyId}
          onChange={(event) => selectProperty(event.target.value)}
          disabled={!loaded}
        >
          <option value="">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </select>
      </label>
      <span className="pk-note">
        {selected ? `Showing ${selected.name} only` : "Showing every property"}
      </span>
    </div>
  );
}