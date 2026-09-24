export const VEHICLE_BRANDS = [
  "Toyota", "Honda", "Nissan", "Suzuki", "Mitsubishi", "Mazda", "Isuzu", "Daihatsu",
  "Hyundai", "Kia", "Bajaj", "TVS", "Yamaha", "Hero", "Tata", "Mahindra",
  "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Perodua", "Proton", "Micro",
  "Ashok Leyland", "Leyland", "Piaggio", "Other",
];

export const VEHICLE_MODELS: Array<{ brand: string; name: string }> = [
  ...["Aqua", "Prius", "Axio", "Allion", "Corolla", "Vitz", "Passo", "Yaris", "Raize", "CHR", "Hilux", "Hiace", "KDH", "Land Cruiser", "Premio", "Roomy"].map((name) => ({ brand: "Toyota", name })),
  ...["Fit", "Vezel", "Grace", "Civic", "Accord", "City", "CR-V", "Freed", "N-WGN", "N-Box", "Insight"].map((name) => ({ brand: "Honda", name })),
  ...["March", "Sunny", "Wingroad", "X-Trail", "Navara", "Caravan", "Leaf", "Dayz"].map((name) => ({ brand: "Nissan", name })),
  ...["Alto", "Wagon R", "Swift", "Celerio", "Every", "Spacia", "Jimny", "Baleno", "Vitara"].map((name) => ({ brand: "Suzuki", name })),
  ...["Lancer", "Outlander", "Montero", "Pajero", "L200", "Ek Wagon"].map((name) => ({ brand: "Mitsubishi", name })),
  ...["Demio", "Axela", "CX-3", "CX-5", "Carol", "Bongo"].map((name) => ({ brand: "Mazda", name })),
  ...["ELF", "D-Max", "Forward"].map((name) => ({ brand: "Isuzu", name })),
  ...["Mira", "Tanto", "Hijet", "Terios", "Copen"].map((name) => ({ brand: "Daihatsu", name })),
  ...["Eon", "Grand i10", "Creta", "Tucson", "Santa Fe"].map((name) => ({ brand: "Hyundai", name })),
  ...["Picanto", "Rio", "Sportage", "Sorento"].map((name) => ({ brand: "Kia", name })),
  ...["RE", "Pulsar", "Discover", "CT100", "Platina"].map((name) => ({ brand: "Bajaj", name })),
  ...["King", "Apache", "Ntorq", "XL100"].map((name) => ({ brand: "TVS", name })),
  ...["FZ", "Ray ZR", "Saluto"].map((name) => ({ brand: "Yamaha", name })),
  ...["HF Deluxe", "Splendor", "Passion", "Glamour"].map((name) => ({ brand: "Hero", name })),
  ...["Nano", "Indica", "Xenon"].map((name) => ({ brand: "Tata", name })),
  ...["KUV100", "Bolero", "Scorpio", "XUV500"].map((name) => ({ brand: "Mahindra", name })),
  ...["C-Class", "E-Class", "S-Class", "GLA", "GLC"].map((name) => ({ brand: "Mercedes-Benz", name })),
  ...["3 Series", "5 Series", "X1", "X3", "X5"].map((name) => ({ brand: "BMW", name })),
  ...["A3", "A4", "A6", "Q2", "Q3", "Q5"].map((name) => ({ brand: "Audi", name })),
  ...["Polo", "Golf", "Passat", "Tiguan"].map((name) => ({ brand: "Volkswagen", name })),
  ...["Axia", "Bezza", "Myvi"].map((name) => ({ brand: "Perodua", name })),
  ...["Saga", "Persona", "Iriz", "Exora"].map((name) => ({ brand: "Proton", name })),
  ...["Panda", "MX7", "Tivoli"].map((name) => ({ brand: "Micro", name })),
  ...["Dost", "Comet", "Bus", "Lorry"].map((name) => ({ brand: "Ashok Leyland", name })),
  ...["Dost", "Comet", "Bus", "Lorry"].map((name) => ({ brand: "Leyland", name })),
  ...["Ape"].map((name) => ({ brand: "Piaggio", name })),
];

export const VEHICLE_TYPES = ["Car", "SUV", "Jeep", "Van", "Cab", "Pickup", "Lorry", "Bus", "Three Wheeler", "Motorbike", "Scooter", "Truck", "Other"];
export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric", "CNG", "LPG", "Other"];
export const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "DCT", "AMT", "Tiptronic", "Other"];
export const ENGINE_CAPACITIES = ["50cc", "100cc", "110cc", "125cc", "150cc", "200cc", "250cc", "300cc", "600cc", "660cc", "800cc", "1000cc", "1300cc", "1500cc", "1600cc", "1800cc", "2000cc", "2200cc", "2500cc", "2700cc", "3000cc", "Other"];
