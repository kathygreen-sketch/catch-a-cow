const COWS = [
  {
    "id": "C001",
    "name": "Brisk Stride",
    "speed": 4,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 4
  },
  {
    "id": "C002",
    "name": "Mossy Bell",
    "speed": 5,
    "temperament": "calm",
    "favoredWeather": "rain",
    "escape": 2,
    "difficulty": 4
  },
  {
    "id": "C003",
    "name": "Sunny Hoof",
    "speed": 9,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 5,
    "difficulty": 8
  },
  {
    "id": "C004",
    "name": "Cobalt Trail",
    "speed": 7,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 1,
    "difficulty": 5
  },
  {
    "id": "C005",
    "name": "Rusty Patch",
    "speed": 3,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 9,
    "difficulty": 7
  },
  {
    "id": "C006",
    "name": "Dapple Gale",
    "speed": 6,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 5
  },
  {
    "id": "C007",
    "name": "Misty Brook",
    "speed": 10,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 9,
    "difficulty": 10
  },
  {
    "id": "C008",
    "name": "Amber Torch",
    "speed": 6,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 6,
    "difficulty": 6
  },
  {
    "id": "C009",
    "name": "Cricket Drift",
    "speed": 9,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 4,
    "difficulty": 8
  },
  {
    "id": "C010",
    "name": "Wilder Sprig",
    "speed": 7,
    "temperament": "stubborn",
    "favoredWeather": "wind",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C011",
    "name": "Bramble Stone",
    "speed": 10,
    "temperament": "curious",
    "favoredWeather": "sun",
    "escape": 2,
    "difficulty": 6
  },
  {
    "id": "C012",
    "name": "Poppy Bloom",
    "speed": 6,
    "temperament": "calm",
    "favoredWeather": "fog",
    "escape": 6,
    "difficulty": 6
  },
  {
    "id": "C013",
    "name": "Pebble Glade",
    "speed": 9,
    "temperament": "curious",
    "favoredWeather": "sun",
    "escape": 3,
    "difficulty": 6
  },
  {
    "id": "C014",
    "name": "Cloud Twine",
    "speed": 2,
    "temperament": "curious",
    "favoredWeather": "rain",
    "escape": 9,
    "difficulty": 6
  },
  {
    "id": "C015",
    "name": "River Spur",
    "speed": 10,
    "temperament": "calm",
    "favoredWeather": "fog",
    "escape": 6,
    "difficulty": 8
  },
  {
    "id": "C016",
    "name": "Biscuit Brim",
    "speed": 5,
    "temperament": "curious",
    "favoredWeather": "sun",
    "escape": 10,
    "difficulty": 8
  },
  {
    "id": "C017",
    "name": "Honey Vale",
    "speed": 2,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 5,
    "difficulty": 5
  },
  {
    "id": "C018",
    "name": "Cedar Branch",
    "speed": 8,
    "temperament": "curious",
    "favoredWeather": "sun",
    "escape": 6,
    "difficulty": 7
  },
  {
    "id": "C019",
    "name": "Juniper Saddle",
    "speed": 3,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 7,
    "difficulty": 5
  },
  {
    "id": "C020",
    "name": "Luna Reed",
    "speed": 6,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 7,
    "difficulty": 7
  },
  {
    "id": "C021",
    "name": "Fable Grit",
    "speed": 9,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 9,
    "difficulty": 10
  },
  {
    "id": "C022",
    "name": "Oak Breeze",
    "speed": 5,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 6,
    "difficulty": 6
  },
  {
    "id": "C023",
    "name": "Sage Whisper",
    "speed": 7,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C024",
    "name": "Tumble Nugget",
    "speed": 5,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 9,
    "difficulty": 7
  },
  {
    "id": "C025",
    "name": "Sprocket Silo",
    "speed": 10,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 4,
    "difficulty": 8
  },
  {
    "id": "C026",
    "name": "Meadow Grove",
    "speed": 4,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 10,
    "difficulty": 7
  },
  {
    "id": "C027",
    "name": "Maple Pine",
    "speed": 3,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 3
  },
  {
    "id": "C028",
    "name": "Comet Field",
    "speed": 5,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 4,
    "difficulty": 5
  },
  {
    "id": "C029",
    "name": "Willow Creek",
    "speed": 6,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 8,
    "difficulty": 7
  },
  {
    "id": "C030",
    "name": "Riddle Hollow",
    "speed": 6,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 4,
    "difficulty": 6
  },
  {
    "id": "C031",
    "name": "Copper Bridge",
    "speed": 5,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 10,
    "difficulty": 9
  },
  {
    "id": "C032",
    "name": "Velvet Canyon",
    "speed": 10,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 1,
    "difficulty": 7
  },
  {
    "id": "C033",
    "name": "Marble Ridge",
    "speed": 4,
    "temperament": "stubborn",
    "favoredWeather": "wind",
    "escape": 10,
    "difficulty": 8
  },
  {
    "id": "C034",
    "name": "Sprout Hearth",
    "speed": 10,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 4,
    "difficulty": 8
  },
  {
    "id": "C035",
    "name": "Waffle Pond",
    "speed": 7,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 4,
    "difficulty": 7
  },
  {
    "id": "C036",
    "name": "Clover Summit",
    "speed": 6,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 1,
    "difficulty": 5
  },
  {
    "id": "C037",
    "name": "Bluebell Furrow",
    "speed": 7,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 7,
    "difficulty": 7
  },
  {
    "id": "C038",
    "name": "Foxglove Prairie",
    "speed": 6,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 6,
    "difficulty": 6
  },
  {
    "id": "C039",
    "name": "Thistle Range",
    "speed": 2,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 10,
    "difficulty": 7
  },
  {
    "id": "C040",
    "name": "Quill Anchor",
    "speed": 8,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 10,
    "difficulty": 10
  },
  {
    "id": "C041",
    "name": "Ginger Gadget",
    "speed": 7,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 6,
    "difficulty": 8
  },
  {
    "id": "C042",
    "name": "Frost Rocket",
    "speed": 7,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 1,
    "difficulty": 4
  },
  {
    "id": "C043",
    "name": "Mango Harbor",
    "speed": 10,
    "temperament": "curious",
    "favoredWeather": "rain",
    "escape": 6,
    "difficulty": 8
  },
  {
    "id": "C044",
    "name": "Opal Compass",
    "speed": 7,
    "temperament": "calm",
    "favoredWeather": "rain",
    "escape": 6,
    "difficulty": 7
  },
  {
    "id": "C045",
    "name": "Pioneer Loom",
    "speed": 2,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 3,
    "difficulty": 3
  },
  {
    "id": "C046",
    "name": "Nova Forge",
    "speed": 4,
    "temperament": "stubborn",
    "favoredWeather": "rain",
    "escape": 10,
    "difficulty": 8
  },
  {
    "id": "C047",
    "name": "Roo Harbor",
    "speed": 8,
    "temperament": "stubborn",
    "favoredWeather": "rain",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C048",
    "name": "Shadow Fjord",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 6,
    "difficulty": 6
  },
  {
    "id": "C049",
    "name": "Grove Beacon",
    "speed": 7,
    "temperament": "stubborn",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 6
  },
  {
    "id": "C050",
    "name": "Topaz Cap",
    "speed": 3,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 4,
    "difficulty": 4
  },
  {
    "id": "C051",
    "name": "Brisk Quarry",
    "speed": 5,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 9,
    "difficulty": 8
  },
  {
    "id": "C052",
    "name": "Mossy Stride",
    "speed": 4,
    "temperament": "stubborn",
    "favoredWeather": "rain",
    "escape": 4,
    "difficulty": 5
  },
  {
    "id": "C053",
    "name": "Sunny Bell",
    "speed": 8,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 7,
    "difficulty": 9
  },
  {
    "id": "C054",
    "name": "Cobalt Hoof",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 8,
    "difficulty": 7
  },
  {
    "id": "C055",
    "name": "Rusty Trail",
    "speed": 9,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 6,
    "difficulty": 8
  },
  {
    "id": "C056",
    "name": "Dapple Patch",
    "speed": 8,
    "temperament": "calm",
    "favoredWeather": "rain",
    "escape": 1,
    "difficulty": 5
  },
  {
    "id": "C057",
    "name": "Misty Gale",
    "speed": 9,
    "temperament": "calm",
    "favoredWeather": "rain",
    "escape": 10,
    "difficulty": 10
  },
  {
    "id": "C058",
    "name": "Amber Brook",
    "speed": 8,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 5,
    "difficulty": 8
  },
  {
    "id": "C059",
    "name": "Cricket Torch",
    "speed": 7,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 2,
    "difficulty": 6
  },
  {
    "id": "C060",
    "name": "Wilder Drift",
    "speed": 9,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 2,
    "difficulty": 7
  },
  {
    "id": "C061",
    "name": "Bramble Sprig",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 9,
    "difficulty": 8
  },
  {
    "id": "C062",
    "name": "Poppy Stone",
    "speed": 9,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 10,
    "difficulty": 10
  },
  {
    "id": "C063",
    "name": "Pebble Bloom",
    "speed": 7,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C064",
    "name": "Cloud Glade",
    "speed": 8,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 3,
    "difficulty": 6
  },
  {
    "id": "C065",
    "name": "River Twine",
    "speed": 6,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 2,
    "difficulty": 5
  },
  {
    "id": "C066",
    "name": "Biscuit Spur",
    "speed": 5,
    "temperament": "calm",
    "favoredWeather": "fog",
    "escape": 7,
    "difficulty": 6
  },
  {
    "id": "C067",
    "name": "Honey Brim",
    "speed": 4,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 9,
    "difficulty": 7
  },
  {
    "id": "C068",
    "name": "Cedar Vale",
    "speed": 10,
    "temperament": "curious",
    "favoredWeather": "rain",
    "escape": 2,
    "difficulty": 6
  },
  {
    "id": "C069",
    "name": "Juniper Branch",
    "speed": 2,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 5,
    "difficulty": 5
  },
  {
    "id": "C070",
    "name": "Luna Saddle",
    "speed": 7,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 5
  },
  {
    "id": "C071",
    "name": "Fable Reed",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 1,
    "difficulty": 4
  },
  {
    "id": "C072",
    "name": "Oak Grit",
    "speed": 9,
    "temperament": "calm",
    "favoredWeather": "rain",
    "escape": 4,
    "difficulty": 7
  },
  {
    "id": "C073",
    "name": "Sage Breeze",
    "speed": 10,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 1,
    "difficulty": 7
  },
  {
    "id": "C074",
    "name": "Tumble Whisper",
    "speed": 9,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 1,
    "difficulty": 5
  },
  {
    "id": "C075",
    "name": "Sprocket Nugget",
    "speed": 8,
    "temperament": "calm",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 6
  },
  {
    "id": "C076",
    "name": "Meadow Silo",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 1,
    "difficulty": 4
  },
  {
    "id": "C077",
    "name": "Maple Grove",
    "speed": 9,
    "temperament": "calm",
    "favoredWeather": "sun",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C078",
    "name": "Comet Pine",
    "speed": 3,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 8,
    "difficulty": 6
  },
  {
    "id": "C079",
    "name": "Willow Field",
    "speed": 5,
    "temperament": "stubborn",
    "favoredWeather": "wind",
    "escape": 2,
    "difficulty": 5
  },
  {
    "id": "C080",
    "name": "Riddle Creek",
    "speed": 2,
    "temperament": "stubborn",
    "favoredWeather": "wind",
    "escape": 10,
    "difficulty": 7
  },
  {
    "id": "C081",
    "name": "Copper Hollow",
    "speed": 4,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 6,
    "difficulty": 5
  },
  {
    "id": "C082",
    "name": "Velvet Bridge",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "fog",
    "escape": 7,
    "difficulty": 7
  },
  {
    "id": "C083",
    "name": "Marble Canyon",
    "speed": 7,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 3,
    "difficulty": 6
  },
  {
    "id": "C084",
    "name": "Sprout Ridge",
    "speed": 8,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 1,
    "difficulty": 6
  },
  {
    "id": "C085",
    "name": "Waffle Hearth",
    "speed": 8,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 8,
    "difficulty": 9
  },
  {
    "id": "C086",
    "name": "Clover Pond",
    "speed": 6,
    "temperament": "skittish",
    "favoredWeather": "sun",
    "escape": 2,
    "difficulty": 5
  },
  {
    "id": "C087",
    "name": "Bluebell Summit",
    "speed": 5,
    "temperament": "stubborn",
    "favoredWeather": "rain",
    "escape": 3,
    "difficulty": 5
  },
  {
    "id": "C088",
    "name": "Foxglove Furrow",
    "speed": 2,
    "temperament": "calm",
    "favoredWeather": "fog",
    "escape": 4,
    "difficulty": 3
  },
  {
    "id": "C089",
    "name": "Thistle Prairie",
    "speed": 6,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 4,
    "difficulty": 5
  },
  {
    "id": "C090",
    "name": "Quill Range",
    "speed": 6,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 6,
    "difficulty": 7
  },
  {
    "id": "C091",
    "name": "Ginger Anchor",
    "speed": 3,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 5,
    "difficulty": 5
  },
  {
    "id": "C092",
    "name": "Frost Gadget",
    "speed": 4,
    "temperament": "skittish",
    "favoredWeather": "rain",
    "escape": 8,
    "difficulty": 7
  },
  {
    "id": "C093",
    "name": "Mango Rocket",
    "speed": 10,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 3,
    "difficulty": 8
  },
  {
    "id": "C094",
    "name": "Opal Harbor",
    "speed": 5,
    "temperament": "skittish",
    "favoredWeather": "wind",
    "escape": 3,
    "difficulty": 5
  },
  {
    "id": "C095",
    "name": "Pioneer Compass",
    "speed": 6,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 4,
    "difficulty": 5
  },
  {
    "id": "C096",
    "name": "Nova Loom",
    "speed": 3,
    "temperament": "stubborn",
    "favoredWeather": "fog",
    "escape": 10,
    "difficulty": 8
  },
  {
    "id": "C097",
    "name": "Roo Forge",
    "speed": 7,
    "temperament": "stubborn",
    "favoredWeather": "sun",
    "escape": 9,
    "difficulty": 9
  },
  {
    "id": "C098",
    "name": "Shadow Harbor",
    "speed": 5,
    "temperament": "curious",
    "favoredWeather": "fog",
    "escape": 9,
    "difficulty": 7
  },
  {
    "id": "C099",
    "name": "Grove Fjord",
    "speed": 8,
    "temperament": "curious",
    "favoredWeather": "wind",
    "escape": 2,
    "difficulty": 5
  }
];
