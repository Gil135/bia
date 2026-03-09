import React from "react";
import { FaSun, FaMoon } from "react-icons/fa";
import { useTheme } from "../contexts/ThemeContext.jsx";
import VersionInfo from "./VersionInfo";
import EC2Info from "./EC2Info"; // ← import do novo componente

const Header = ({ title }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="header">
      <h1>{title}</h1>

      <div className="header-controls">

        {/* Informações da instância EC2 — Instance ID e IPs */}
        <EC2Info />

        {/* Status da API e versão — componente original do projeto */}
        <VersionInfo />

        {/* Alternância entre tema claro e escuro */}
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
