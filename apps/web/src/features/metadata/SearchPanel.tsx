
import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { SearchFilters } from "./types";

interface SearchPanelProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<
    React.SetStateAction<SearchFilters>
  >;
  onSearch: (e: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}

export default function SearchPanel({
  filters,
  setFilters,
  onSearch,
  onReset
}: SearchPanelProps) {

  const updateField = (
    field: keyof SearchFilters,
    value: string
  ) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value
    }));

    if (value.trim() !== "") {
      setShowError(false);
    }
  };

  const [showError, setShowError] = useState(false);
  const [wildcardError, setWildcardError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0
  });

  const showDagTooltip = (
    e: React.MouseEvent<HTMLSpanElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();

    setTooltipPosition({
      top: rect.top - 8,
      left: rect.left
    });

    setShowTooltip(true);
  };

  const isWildcardValid = (value: string) => {
    if (!value.includes("*")) {
      return true;
    }

    const parts = value.split("*");

    return parts.every((part, index) => {
      // At least 4 characters before the first *
      if (index === 0) {
        return part.trim().length >= 5;
      }

      return true;
    });
  };

  const handleSearch = (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const hasValue =
      filters.dagName.trim() !== "" ||
      filters.unitName.trim() !== "" ||
      filters.applicationId.trim() !== "";

    if (!hasValue) {
      setShowError(true);
      setWildcardError(false);
      onReset();
      return;
    }

    // WILDCARD VALIDATION
    if (!isWildcardValid(filters.dagName)) {
      setWildcardError(true);
      setShowError(false);
      onReset();
      return;
    }


    setShowError(false);
    setWildcardError(false);

    // Calls MetadataPage handleSearch
    onSearch(e);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6"
    >

      <div className="flex flex-nowrap items-end gap-4 overflow-x-auto pb-2">

        {/* DAG NAME */}

        <div className="flex flex-col gap-2 flex-1 min-w-[180px] px-2">

          <label className="text-sm font-semibold text-slate-700 flex items-center">
            DAG/Task Name

            <span
              className="ml-2 text-slate-400 cursor-pointer"
              onMouseEnter={showDagTooltip}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              ⓘ
            </span>
          </label>

          <input
            type="text"
            placeholder="Enter DAG or Task Name"
            value={filters.dagName}
            onChange={(e) =>
              updateField("dagName", e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />

        </div>

         <div className="flex flex-col gap-2 flex-1 min-w-[180px]">

          <label className="text-sm font-semibold text-slate-700">
            Application Id
          </label>

          <input
            type="text"
            placeholder="Enter Application Id"
            value={filters.applicationId}
            onChange={(e) =>
              updateField("applicationId", e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />

        </div>

        {/* BUSINESS UNIT */}

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">

          <label className="text-sm font-semibold text-slate-700">
            Business Unit Name
          </label>

          <select
            value={filters.unitName}
            onChange={(e) =>
              updateField("unitName", e.target.value)
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Business Unit</option>
            <option value="FFIO">FFIO</option>
            <option value="AMT">AMT</option>
            <option value="LAB">LAB</option>
          </select>

        </div>


       

        {/* STATUS */}




        {/* BUTTONS */}

        <div className="flex items-end gap-2 shrink-0">

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => {
              setShowError(false);
              setWildcardError(false);
              onReset();
            }}

            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Reset
          </button>

        </div>

      </div>
      {showError && (
        <p className="mt-3 text-sm text-red-600 font-medium">
          Please enter at least one search field.
        </p>
      )}
      {/* NEW WILDCARD ERROR */}
      {wildcardError && (
        <p className="mt-3 text-sm text-red-600 font-medium">
          Please enter at least 5 characters before using wildcard (*).
        </p>
      )}
      {showTooltip &&
        createPortal(
          <div
            className="fixed w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: "translateY(-100%)",
              zIndex: 99999
            }}
          >
            Use * as a wildcard to search multiple DAG
            or task names. Example: DAG*.
          </div>,
          document.body
        )}
    </form>
  );
}
