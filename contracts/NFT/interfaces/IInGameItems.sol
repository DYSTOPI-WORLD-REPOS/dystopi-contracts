// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IInGameItems {
    struct ItemSeries {
        uint itemId;
        uint itemType;
        uint slots;
        uint startingTokenId;
        uint editionSize;
        uint minted;
    }

    struct ItemSeriesIn {
        uint itemId;
        uint itemType;
        uint slots;
        uint itemSeriesId;
        uint editionSize;
    }

    function mint(address to, uint[] calldata itemIds, uint[] calldata itemSeriesIds, uint[] calldata amounts) external;

    function getItemSeries(uint itemId, uint itemSeriesId) external returns (ItemSeries memory);
}
