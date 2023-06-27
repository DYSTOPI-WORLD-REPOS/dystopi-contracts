// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IInGameItems {
    struct Item {
        uint itemId;
        uint itemType;
        uint slots;
        uint rarity;
    }

    struct ItemSeries {
        uint itemId;
        uint itemSeriesId;
        uint startingTokenId;
        uint editionSize;
        uint minted;
    }

    struct ItemSeriesIn {
        uint itemId;
        uint itemSeriesId;
        uint editionSize;
    }

    struct ItemSeriesOut {
        uint itemId;
        uint itemSeriesId;
        uint itemType;
        uint slots;
        uint rarity;
        uint startingTokenId;
        uint editionSize;
        uint minted;
    }

    function mint(address to, uint[] calldata itemIds, uint[] calldata itemSeriesIds, uint[] calldata amounts) external;

    function getItem(uint itemId) external returns (Item memory);

    function getItemSeries(uint itemId, uint itemSeriesId) external returns (ItemSeriesOut memory);
}
