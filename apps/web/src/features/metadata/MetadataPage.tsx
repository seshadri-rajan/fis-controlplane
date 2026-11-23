
import React, { useState } from "react";

import type { Dag, SearchFilters } from "./types";

import { dummyData, matchesWildcard, dummyDagTaskData } from "./data";

import SearchPanel from "./SearchPanel";

import ResultsPanel from "./ResultsPanel";

// ==========================================
// INITIAL SEARCH FILTERS
// ==========================================

const initialFilters: SearchFilters = {
  dagName: "",
  unitName: "",
  taskName: "",
  applicationId: "",
  status: "All",
  startDate: "",
  endDate: ""
};

// ==========================================
// MAIN METADATA PAGE
// ==========================================

export default function MetadataPage() {

  // ==========================================
  // SEARCH FILTER STATE
  // ==========================================

  const [filters, setFilters] =
    useState<SearchFilters>(initialFilters);

  // ==========================================
  // SEARCH RESULTS
  // ==========================================

  const [filteredData, setFilteredData] =
    useState<Dag[]>([]);

  const [hasSearched, setHasSearched] =
    useState(false);

  // ==========================================
  // SELECTED DAG / DRAWER STATE
  // ==========================================

  const [selectedDag, setSelectedDag] =
    useState<Dag | null>(null);

  // ==========================================
  // OPEN DRAWER
  // ==========================================

  const handleSelectDag = (dag: Dag) => {
    setSelectedDag(dag);
  };


  // ==========================================
  // CLOSE DRAWER
  // ==========================================

  const handleCloseDrawer = () => {
    setSelectedDag(null);
  };

  // ==========================================
  // SEARCH FUNCTION
  // ==========================================

  const handleSearch = (
    e: React.FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault();
    // VALIDATION: At least one field is required
    const hasSearchValue =
      filters.dagName.trim() !== "" ||
      filters.unitName.trim() !== "" ||
      filters.taskName.trim() !== "" ||
      filters.applicationId.trim() !== "";

    if (!hasSearchValue) {
      return;
    }
    const searchValue = filters.dagName.trim();

    // Select dataset based on search input
    const sourceData: Dag[] =
      /^task/i.test(searchValue)
        ? dummyDagTaskData
        : dummyData;

    const results = sourceData.filter((item) => {

      // DAG / TASK NAME FILTER
      const matchesDagOrTask =
        !searchValue ||
        matchesWildcard(item.name, searchValue) ||
        (
          sourceData === dummyDagTaskData &&
          matchesWildcard(item.dagTaskName, searchValue)
        );

      // BUSINESS UNIT FILTER
      const matchesUnit = matchesWildcard(
        item.businessUnit,
        filters.unitName
      );

      // APPLICATION ID / TASK NAME FILTER
      const matchesTask = matchesWildcard(
        item.dagTaskName,
        filters.taskName
      );


      const matchesApplicationId =
        !filters.applicationId ||
        String(item.applicationId ?? "").trim() ===
        filters.applicationId.trim();

      return (
        matchesDagOrTask &&
        matchesUnit &&
        matchesTask &&
        matchesApplicationId
      );

    });

    setFilteredData(results);

    setHasSearched(true);

    setSelectedDag(null);
  };


  // ==========================================
  // RESET FUNCTION
  // ==========================================

  const handleReset = () => {

    setFilters({
      ...initialFilters
    });

    setFilteredData([]);

    setHasSearched(false);

    setSelectedDag(null);
  };

  // ==========================================
  // PAGE JSX
  // ==========================================

  return (

    <div className="min-h-screen bg-slate-50 text-slate-800">

      <main className="w-full p-2 md:p-2">

        {/* ==================================
            SEARCH COMPONENT
        ================================== */}

        <SearchPanel
          filters={filters}
          setFilters={setFilters}
          onSearch={handleSearch}
          onReset={handleReset}
        />

        {/* ==================================
            RESULTS COMPONENT
        ================================== */}

        {hasSearched && (

          <ResultsPanel
            filteredData={filteredData}
            selectedDag={selectedDag}
            onSelectDag={handleSelectDag}
            onCloseDrawer={handleCloseDrawer}
          />

        )}



      </main>

    </div>
  );
}
