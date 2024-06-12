// ==UserScript==
// @name        Steam Redirect Links
// @namespace   http://tampermonkey.net/
// @version     2.2
// @description Adds redirect links for game titles on Steam
// @match       https://store.steampowered.com/app/*
// @icon        https://www.google.com/s2/favicons?domain=store.steampowered.com
// @grant       none
// ==/UserScript==

(function () {
  "use strict";

  // External Link Data
  const externalLinks = {
    "Official Stores": [
      {
        name: "GOG",
        url: "https://www.gog.com/en/games?query=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=www.gog.com",
      },
      {
        name: "EA",
        url: "https://www.ea.com/games/library/",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=www.ea.com",
      },
      {
        name: "Xbox",
        url: "https://www.xbox.com/en-us/Search/Results?q=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=www.xbox.com",
      },
      {
        name: "Epic Games Store",
        url: "https://store.epicgames.com/en-US/browse?q=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=store.epicgames.com",
      },
    ],
    "Other Sources": [
      {
        name: "Gload",
        url: "https://gload.to/?s=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=gload.to",
      },
      {
        name: "GOG-Games",
        url: "https://gog-games.com/search/",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=gog-games.com",
      },
      {
        name: "OVA Games",
        url: "https://www.ovagames.com/?s=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=www.ovagames.com",
      },
      {
        name: "SteamRIP",
        url: "https://steamrip.com/?s=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=steamrip.com",
      },
      {
        name: "FitGirl Repacks",
        url: "https://fitgirl-repacks.site/?s=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=fitgirl-repacks.site",
      },
      {
        name: "CS.RIN.RU",
        url: "https://cs.rin.ru/forum/search.php?st=0&sk=t&sd=d&sr=topics&keywords=", // Base URL for CS.RIN.RU https://cs.rin.ru/forum/search.php?st=0&sk=t&sd=d&sr=topics&keywords=elden+ring
        icon: "https://www.google.com/s2/favicons?sz=16&domain=cs.rin.ru",
        additionalParams:
          "&terms=any&sf=titleonly",
      },
      {
        name: "DownloadHA",
        url: "https://www.downloadha.com/?s=",
        icon: "https://www.google.com/s2/favicons?sz=16&domain=www.downloadha.com",
      },
    ],
  };

  // Function to Create Link Elements
  // Function to Sanitize Game Title for Search
  const sanitizeGameTitle = (title) => {
    return title.replace(/[^a-zA-Z0-9\s]/g, " "); // Removing special characters except spaces
  };

  // Function to Create Link Elements
// Function to Create Link Elements
const createLinkElement = (linkData) => {
  const link = document.createElement("a");
  const gameTitle = encodeURIComponent(sanitizeGameTitle(getGameTitle()));

  if (linkData.additionalParams) {
    link.href = `${linkData.url}${gameTitle}${linkData.additionalParams}`;
  } else {
    link.href = `${linkData.url}${gameTitle}`;
  }
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "steam-redirect-link btnv6_blue_hoverfade";

  // Style the link to match Steam's buttons
  link.style.borderRadius = "2px";
  link.style.border = "none";
  link.style.padding = "1px";
  link.style.display = "inline-block";
  link.style.cursor = "pointer";
  link.style.textDecoration = "none";
  link.style.color = "#67c1f5";
  link.style.background = "rgba(103, 193, 245, 0.2)";
  link.style.fontFamily = "'Motiva Sans', Arial, Helvetica, sans-serif";
  link.style.fontSize = "16px"; // Increase the font size
  link.style.padding = "8px 16px"; // Increase the padding
  link.style.marginBottom = "8px"; // Increase the margin bottom

  // Hover effect
  link.addEventListener("mouseover", () => {
    link.style.color = "#ffffff";
    link.style.background = "linear-gradient(135deg, #67c1f5 0%, #417a9b 100%)";
  });

  link.addEventListener("mouseout", () => {
    link.style.color = "#67c1f5";
    link.style.background = "rgba(103, 193, 245, 0.2)";
  });

  const icon = document.createElement("img");
  icon.src = linkData.icon;
  icon.width = 16;
  icon.height = 16;
  icon.style.marginRight = "8px"; // Increase the margin right
  link.appendChild(icon);

  link.appendChild(document.createTextNode(linkData.name));

  return link;
};


// Function to Create Link Group
const createLinkGroup = (groupName, linksData) => {
  const groupDiv = document.createElement("div");
  groupDiv.style.marginBottom = "10px";

  const title = document.createElement("h3");
  title.textContent = groupName;
  title.style.color = "#ffffff";
  title.style.fontSize = "16px";
  title.style.marginBottom = "5px";
  title.style.textAlign = "center"; // Center the title
  groupDiv.appendChild(title);

  const linksContainer = document.createElement("div");
  linksContainer.style.display = "flex";
  linksContainer.style.flexWrap = "wrap";
  linksContainer.style.gap = "8px";
  linksContainer.style.justifyContent = "center";
  linksData.forEach((linkData) => {
    const linkElement = createLinkElement(linkData);
    linksContainer.appendChild(linkElement);
  });
  groupDiv.appendChild(linksContainer);

  return groupDiv;
};



  // Function to Get Game Title
  const getGameTitle = () => {
    try {
      return document.querySelector("#appHubAppName").textContent.trim();
    } catch (error) {
      console.error("Error getting game title:", error);
      return "";
    }
  };
// Function to add the links to the page
const addLinksToPage = () => {
  try {
    const targetContainer = document.querySelector(".queue_overflow_ctn");

    if (targetContainer) {
      const externalLinksContainer = document.createElement("div");
      externalLinksContainer.style.backgroundColor = "#1b2838";
      externalLinksContainer.style.border = "1px solid #2a2d35";
      externalLinksContainer.style.padding = "10px";
      externalLinksContainer.style.borderRadius = "4px";
      externalLinksContainer.style.marginBottom = "15px";
      externalLinksContainer.style.width = "940px";
      externalLinksContainer.style.margin = "0 auto";

      for (const groupName in externalLinks) {
        try {
          externalLinksContainer.appendChild(
            createLinkGroup(groupName, externalLinks[groupName])
          );
        } catch (error) {
          console.error(`Error creating link group "${groupName}":`, error);
        }
      }

      targetContainer.appendChild(externalLinksContainer);
    } else {
      console.error("Target container not found:", ".queue_overflow_ctn");
    }
  } catch (error) {
    console.error("Error adding links to the page:", error);
  }
};

  // Function to initialize the userscript
  const initUserscript = () => {
    try {
      addLinksToPage();
    } catch (error) {
      console.error("Error initializing userscript:", error);
    }
  };

  // Wait for the page to load and the DOM to be ready before initializing the userscript
  window.addEventListener("load", initUserscript);
  document.addEventListener("DOMContentLoaded", initUserscript);
})();
