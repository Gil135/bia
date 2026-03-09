import React from "react";
import { FaSun, FaMoon } from "react-icons/fa";

import { useTheme } from "../contexts/ThemeContext.jsx";

import VersionInfo from "./VersionInfo";

import EC2Info from "./EC2Info";

const Header = ({ title }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="header">
      <h1>{title}</h1>
      <div className="header-controls">

        <EC2Info />

        <VersionInfo />

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={isDarkMode ? "Tema claro" : "Tema escuro"}
        >
          {isDarkMode ? <FaSun /> : <FaMoon />}
        </button>

      </div>
    </header>
  );
};

Header.defaultProps = {
  title: "BIA 2026",
};

export default Header;
