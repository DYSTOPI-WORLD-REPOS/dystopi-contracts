function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}
const generateItem = (itemId, itemType, slots) => ({
  itemId,
  itemType,
  slots,
  rarity: randomIntFromInterval(1, 5)
});

const generateRandomItemSeries = (
  { itemId, itemType, slots, rarity },
  itemSeriesId
) => ({
  itemId,
  itemSeriesId,
  itemType,
  slots,
  rarity,
  editionSize: randomIntFromInterval(50, 100)
});

module.exports = {
  randomIntFromInterval,
  generateItem,
  generateRandomItemSeries
};
